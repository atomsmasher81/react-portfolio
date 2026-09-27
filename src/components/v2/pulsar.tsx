'use client';

import { useEffect, useRef, useState } from "react";
import { Gauge, Volume2, VolumeX } from "lucide-react";

// A pulsar, modelled rather than faked: a spinning neutron star whose magnetic
// axis is tilted from its spin axis, so its two radio beams sweep a cone. When a
// beam crosses our line of sight we see a flash and the "telescope" trace below
// logs a spike. Real speed runs at the Crab Pulsar's 30 turns a second; sound
// turns every pulse into a click, which at real speed becomes a buzz.

const MAG_TILT = (40 * Math.PI) / 180; // magnetic axis vs spin axis
const VIEW_TILT = (46 * Math.PI) / 180; // spin axis leaning toward us, so a beam grazes our eye
const SLOW_HZ = 0.42;
const REAL_HZ = 30;

type V3 = [number, number, number];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => scale(a, 1 / Math.hypot(...a));

// Spin axis is +y; tilt the whole system toward the viewer (+z) around x.
function view([x, y, z]: V3): V3 {
    const c = Math.cos(VIEW_TILT);
    const s = Math.sin(VIEW_TILT);
    return [x, y * c - z * s, y * s + z * c];
}

function magAxis(phase: number): V3 {
    return view([Math.sin(MAG_TILT) * Math.cos(phase), Math.cos(MAG_TILT), Math.sin(MAG_TILT) * Math.sin(phase)]);
}

// How much a beam is pointing at us, 0..1, sharply peaked like a real pulse.
function pulse(phase: number) {
    const m = magAxis(phase);
    const toward = Math.max(m[2], -m[2]); // either beam
    return Math.pow(Math.max(0, (toward - 0.93) / 0.07), 3);
}

export function Pulsar() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [real, setReal] = useState(false);
    const [sound, setSound] = useState(false);
    const realRef = useRef(real);
    const soundRef = useRef(sound);
    const audioRef = useRef<AudioContext | null>(null);
    realRef.current = real;
    soundRef.current = sound;

    const toggleSound = () => {
        if (!audioRef.current) {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioRef.current = new Ctx();
        }
        audioRef.current.resume();
        setSound((s) => !s);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let w = 0;
        let h = 0;
        let raf = 0;
        let phase = 0.4;
        let last = performance.now();
        let clock = 0; // seconds of simulated time, for the trace
        const particles: { p: V3; v: V3; life: number }[] = [];

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = canvas.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const click = (at: number) => {
            const ac = audioRef.current;
            if (!ac || !soundRef.current) return;
            const len = Math.floor(ac.sampleRate * 0.006);
            const buf = ac.createBuffer(1, len, ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
            const src = ac.createBufferSource();
            src.buffer = buf;
            const filter = ac.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = 1800;
            const gain = ac.createGain();
            gain.gain.value = 0.35;
            src.connect(filter).connect(gain).connect(ac.destination);
            src.start(ac.currentTime + at);
        };

        const frame = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const hz = realRef.current ? REAL_HZ : reduce ? SLOW_HZ * 0.3 : SLOW_HZ;
            const omega = 2 * Math.PI * hz;
            const prev = phase;
            phase += omega * dt;
            clock += dt;

            // Beams face us at phase = π/2 and 3π/2 (mod 2π); click on each crossing.
            const crossings = (p: number) => Math.floor((p - Math.PI / 2) / Math.PI);
            const n = crossings(phase) - crossings(prev);
            for (let i = 0; i < n; i++) click((i / Math.max(1, n)) * dt);

            const cx = w / 2;
            const traceH = 64;
            const cy = (h - traceH) / 2;
            const R = Math.min(w, h - traceH) * 0.42;
            const proj = (v: V3) => [cx + v[0] * R, cy - v[1] * R] as const;

            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = "lighter";

            const flash = realRef.current ? 0.2 : pulse(phase);

            // Flash of light washing over everything when a beam is on us.
            if (flash > 0.01) {
                // Kept inside the canvas so the glow never shows a hard edge.
                const reach = Math.min(R * 1.5, cy, cx);
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
                g.addColorStop(0, `rgba(190,210,255,${0.55 * flash})`);
                g.addColorStop(1, "rgba(190,210,255,0)");
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h - traceH);
            }

            // Spin axis
            const up = view([0, 1.15, 0]);
            const [ax1, ay1] = proj(up);
            const [ax2, ay2] = proj(scale(up, -1));
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = "rgba(157,180,255,0.25)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax1, ay1);
            ctx.lineTo(ax2, ay2);
            ctx.stroke();
            ctx.setLineDash([]);

            // In real-speed mode, smear the beams over a full turn: that's what 30 Hz looks like.
            const samples = realRef.current ? 28 : 1;
            for (let sIdx = 0; sIdx < samples; sIdx++) {
                const ph = samples === 1 ? phase : phase + (sIdx / samples) * Math.PI * 2;
                const m = magAxis(ph);
                const alpha = samples === 1 ? 1 : 0.08;

                // Magnetic field lines: dipole loops r = k·sin²θ around the magnetic axis.
                if (samples === 1) {
                    const p1 = norm(cross(m, view([0, 1, 0])));
                    const p2 = cross(m, p1);
                    ctx.lineWidth = 1;
                    for (let loop = 0; loop < 6; loop++) {
                        const psi = (loop / 6) * Math.PI * 2;
                        const q = add(scale(p1, Math.cos(psi)), p2, Math.sin(psi));
                        for (const k of [0.55, 0.85]) {
                            ctx.beginPath();
                            for (let t = 0.18; t <= Math.PI - 0.18; t += 0.08) {
                                const r = k * Math.sin(t) ** 2;
                                const v = add(scale(q, r * Math.sin(t)), m, r * Math.cos(t));
                                const [x, y] = proj(v);
                                if (t === 0.18) ctx.moveTo(x, y);
                                else ctx.lineTo(x, y);
                            }
                            const depth = q[2];
                            ctx.strokeStyle = `rgba(157,180,255,${0.1 + 0.12 * (depth + 1) * 0.5})`;
                            ctx.stroke();
                        }
                    }
                }

                // The two beams, opposite each other along the magnetic axis.
                for (const dir of [1, -1]) {
                    const tip = scale(m, dir * 1.25);
                    const [tx, ty] = proj(tip);
                    const len = Math.hypot(tx - cx, ty - cy) || 1;
                    const nx = -(ty - cy) / len;
                    const ny = (tx - cx) / len;
                    const spread = R * 0.16;
                    const facing = Math.max(0, tip[2] / 1.25); // brighter when pointing our way
                    const g = ctx.createLinearGradient(cx, cy, tx, ty);
                    g.addColorStop(0, `rgba(210,225,255,${(0.75 + 0.25 * facing) * alpha})`);
                    g.addColorStop(1, "rgba(120,150,255,0)");
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(tx + nx * spread, ty + ny * spread);
                    ctx.lineTo(tx - nx * spread, ty - ny * spread);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // Particles streaming out along the beams.
            if (!reduce && !realRef.current && Math.random() < 0.7) {
                const m = magAxis(phase);
                const dir = Math.random() < 0.5 ? 1 : -1;
                particles.push({ p: [0, 0, 0], v: scale(m, dir * (0.5 + Math.random() * 0.5)), life: 1 });
            }
            for (let i = particles.length - 1; i >= 0; i--) {
                const pt = particles[i];
                pt.p = add(pt.p, pt.v, dt * 1.4);
                pt.life -= dt * 0.9;
                if (pt.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                const [x, y] = proj(pt.p);
                ctx.fillStyle = `rgba(200,215,255,${pt.life * 0.7})`;
                ctx.fillRect(x, y, 1.5, 1.5);
            }

            // The star itself: about 20 km across, heavier than the Sun.
            ctx.globalCompositeOperation = "source-over";
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
            glow.addColorStop(0, "rgba(255,255,255,1)");
            glow.addColorStop(0.25, `rgba(200,220,255,${0.9 + flash * 0.1})`);
            glow.addColorStop(1, "rgba(120,150,255,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
            ctx.fill();

            // Telescope trace: intensity over the last few seconds, computed exactly
            // from the spin, so it stays correct even at 30 turns a second.
            const top = h - traceH;
            ctx.strokeStyle = "rgba(157,180,255,0.18)";
            ctx.beginPath();
            ctx.moveTo(0, top + 0.5);
            ctx.lineTo(w, top + 0.5);
            ctx.stroke();
            const span = realRef.current ? 0.2 : 7;
            ctx.strokeStyle = "rgba(157,180,255,0.9)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 1) {
                const back = (1 - x / w) * span;
                const ph = phase - omega * back;
                const noise = (Math.sin((clock - back) * 97.3) + Math.sin((clock - back) * 61.7)) * 0.02;
                const v = pulse(ph) + noise;
                const y = h - 10 - v * (traceH - 22);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            raf = requestAnimationFrame(frame);
        };

        resize();
        raf = requestAnimationFrame(frame);
        window.addEventListener("resize", resize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    useEffect(() => () => void audioRef.current?.close(), []);

    return (
        <div>
            <canvas ref={canvasRef} aria-label="Animated pulsar sweeping its radio beams" role="img" className="h-[440px] w-full sm:h-[500px]" />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <button
                    onClick={() => setReal((r) => !r)}
                    aria-pressed={real}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 transition-colors ${
                        real ? "bg-[var(--accent)] text-[#05060f]" : "text-[var(--muted)] ring-1 ring-[var(--faint)] hover:text-[var(--ink)]"
                    }`}
                >
                    <Gauge className="h-4 w-4" strokeWidth={1.75} />
                    {real ? "Real speed: 30 turns a second" : "Slowed down about 70×"}
                </button>
                <button
                    onClick={toggleSound}
                    aria-pressed={sound}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 transition-colors ${
                        sound ? "bg-[var(--accent)] text-[#05060f]" : "text-[var(--muted)] ring-1 ring-[var(--faint)] hover:text-[var(--ink)]"
                    }`}
                >
                    {sound ? <Volume2 className="h-4 w-4" strokeWidth={1.75} /> : <VolumeX className="h-4 w-4" strokeWidth={1.75} />}
                    {sound ? "Listening" : "Listen to it"}
                </button>
            </div>
        </div>
    );
}
