'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { SpotifyIcon, YouTubeIcon } from "@/components/v2/brand-icons";
import type { NowEntry } from "@/data/v2/now";

type Song = NonNullable<NowEntry["listening"]>;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const RPM = 33.3;

// The song stuck in my head, with a little turntable beside it. Pressing play
// swings the arm onto the record and it spins up. The audio is the YouTube
// video, kept out of sight and driven over postMessage so the controls here
// follow the real player. It loops, of course.
//
// The player is loaded as the section comes into view so a tap can start it
// straight away. Some phones (iPhones mostly) still refuse to start sound in
// an embedded player unless the tap lands on the player itself; if nothing is
// playing shortly after a tap, the video shows up for that one tap and then
// tucks itself away again.
export function OnLoop({ song }: { song: Song }) {
    const root = useRef<HTMLDivElement>(null);
    const frame = useRef<HTMLIFrameElement>(null);
    const ready = useRef(false);
    const want = useRef(false);
    const confirmed = useRef(false);
    const watchdog = useRef<number>();
    const [near, setNear] = useState(false);
    const [started, setStarted] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [needsTap, setNeedsTap] = useState(false);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const send = useCallback((func: string, args: unknown[] = []) => {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    }, []);

    // Load the player a little before it scrolls into view.
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: "300px" });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!near) return;
        const onMessage = (e: MessageEvent) => {
            if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
            let data: { event?: string; info?: unknown };
            try {
                data = JSON.parse(e.data);
            } catch {
                return;
            }
            if (!ready.current) {
                ready.current = true;
                // Tapped before the player was ready: try now.
                if (want.current) send("playVideo");
            }
            const state = data.event === "onStateChange" ? data.info : (data.info as { playerState?: number } | null)?.playerState;
            if (state === 0) {
                send("seekTo", [0, true]);
                send("playVideo");
            } else if (state === 1) {
                confirmed.current = true;
                window.clearTimeout(watchdog.current);
                setPlaying(true);
                setNeedsTap(false);
            } else if (state === 2) {
                setPlaying(false);
            }
            const info = data.info as { currentTime?: number; duration?: number } | null;
            if (info && typeof info.currentTime === "number") setTime(info.currentTime);
            if (info && typeof info.duration === "number" && info.duration > 0) setDuration(info.duration);
        };
        window.addEventListener("message", onMessage);
        // The player only starts reporting once it's asked to; keep asking until it answers.
        const hello = window.setInterval(() => {
            if (ready.current) return window.clearInterval(hello);
            frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: song.youtube, channel: "widget" }), "*");
        }, 250);
        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(hello);
        };
    }, [near, song.youtube, send]);

    useEffect(() => () => window.clearTimeout(watchdog.current), []);

    const toggle = () => {
        if (playing) {
            want.current = false;
            send("pauseVideo");
            setPlaying(false);
            return;
        }
        want.current = true;
        confirmed.current = false;
        setStarted(true);
        setPlaying(true);
        setNear(true);
        // Called inside the tap, which is what lets most browsers start the sound.
        if (ready.current) send("playVideo");
        window.clearTimeout(watchdog.current);
        watchdog.current = window.setTimeout(() => {
            if (confirmed.current) return;
            setPlaying(false);
            setNeedsTap(true);
        }, 2500);
    };

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        const to = ((e.clientX - r.left) / r.width) * duration;
        send("seekTo", [to, true]);
        setTime(to);
    };

    const progress = duration ? Math.min(1, time / duration) : 0;

    return (
        <div ref={root} className="relative flex flex-col items-center">
            <div className="group flex flex-col items-center gap-5 text-center sm:flex-row sm:gap-6 sm:text-left">
                <Turntable cover={song.cover} playing={playing} progress={progress} onClick={toggle} label={`${playing ? "Pause" : "Play"} ${song.title} by ${song.artist}`} />

                <div className="min-w-0">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted)]">Stuck in my head</p>
                    <p className="mt-1 text-[1.2rem] leading-snug tracking-tight sm:text-[1.3rem]">
                        <span className="font-semibold">{song.title}</span> <span className="text-[var(--muted)]">by {song.artist}</span>
                    </p>

                    <div className="mt-3 flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-3 text-[12px] text-[var(--muted)] sm:mt-2 sm:flex-nowrap sm:justify-start sm:gap-x-3">
                        <button
                            type="button"
                            onClick={toggle}
                            className="inline-flex w-[54px] items-center gap-1.5 font-medium text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                        >
                            {playing ? <Pause className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
                            {playing ? "Pause" : "Play"}
                        </button>

                        <div className="flex w-[150px] min-w-0 shrink items-center gap-2 sm:w-[130px]">
                            <div
                                onClick={seek}
                                className={`relative h-[3px] flex-1 rounded-full bg-[var(--faint)] ${duration ? "cursor-pointer" : ""}`}
                            >
                                <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]" style={{ width: `${progress * 100}%` }} />
                            </div>
                            <span className="w-[30px] font-mono text-[11px] tabular-nums">{started ? fmt(time) : "3:50"}</span>
                        </div>

                        {/* Where to hear it properly: its own quiet line on phones, icons that appear on hover on desktop. */}
                        <span className="flex basis-full items-center justify-center gap-5 opacity-70 transition-opacity duration-300 sm:ml-1 sm:basis-auto sm:gap-2.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            {song.spotify && (
                                <a
                                    href={`https://open.spotify.com/track/${song.spotify}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Open in Spotify"
                                    title="Spotify"
                                    className="inline-flex items-center gap-1.5 transition-colors hover:text-[#1DB954]"
                                >
                                    <SpotifyIcon className="h-3.5 w-3.5" />
                                    <span className="sm:hidden">Spotify</span>
                                </a>
                            )}
                            <a
                                href={`https://music.youtube.com/watch?v=${song.youtube}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open in YouTube Music"
                                title="YouTube Music"
                                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#FF0033]"
                            >
                                <YouTubeIcon className="h-3.5 w-3.5" />
                                <span className="sm:hidden">YouTube Music</span>
                            </a>
                        </span>
                    </div>
                </div>
            </div>

            {needsTap && <p className="mt-5 text-[13px] text-[var(--muted)]">Your phone wants one tap on the video itself. After that, it&apos;s all turntable.</p>}

            {/* The same iframe either way, so it never reloads: out of sight normally, shown only for that one tap. */}
            {near && (
                <div
                    aria-hidden={!needsTap}
                    className={
                        needsTap
                            ? "relative mt-3 aspect-video w-[280px] max-w-full overflow-hidden rounded-xl bg-black shadow-[0_14px_30px_-14px_rgba(14,28,51,0.5)]"
                            : "pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
                    }
                >
                    <iframe
                        ref={frame}
                        src={`https://www.youtube-nocookie.com/embed/${song.youtube}?enablejsapi=1&playsinline=1&controls=1&rel=0`}
                        title={`${song.artist} - ${song.title}`}
                        allow="autoplay; encrypted-media"
                        tabIndex={needsTap ? 0 : -1}
                        className={needsTap ? "absolute inset-0 h-full w-full" : "absolute left-0 top-0 h-[200px] w-[200px]"}
                    />
                </div>
            )}
        </div>
    );
}

// A small record player, drawn from the top: enamel plinth, a platter with
// strobe dots, a grooved record with the cover as its label, and an S-shaped
// arm. Pressing play lifts the arm across (its shadow grows as it rises), the
// platter eases up to 33⅓ and the needle creeps inward as the song goes.
const W = 156;
const H = 116;
const PIVOT = { x: 132, y: 22 };
const DOTS = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);

function Turntable({ cover, playing, progress, onClick, label }: { cover: string; playing: boolean; progress: number; onClick: () => void; label: string }) {
    const platter = useRef<HTMLSpanElement>(null);
    const spin = useRef({ angle: 0, speed: 0 });
    const [lifts, setLifts] = useState(0);
    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) setLifts((n) => n + 1);
        mounted.current = true;

        const s = spin.current;
        const target = playing ? (RPM * 360) / 60 : 0; // degrees per second
        let raf = 0;
        let last = 0;
        const tick = (now: number) => {
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            last = now;
            s.speed += (target - s.speed) * Math.min(1, dt * (playing ? 2 : 0.9));
            s.angle = (s.angle + s.speed * dt) % 360;
            if (platter.current) platter.current.style.transform = `rotate(${s.angle}deg)`;
            if (!playing && s.speed < 0.3) return;
            raf = requestAnimationFrame(tick);
        };
        // Motor starts as the arm is on its way over.
        const delay = window.setTimeout(() => (raf = requestAnimationFrame(tick)), playing ? 250 : 0);
        return () => {
            window.clearTimeout(delay);
            cancelAnimationFrame(raf);
        };
    }, [playing]);

    // 0° sits in the rest, 34° drops onto the lead-in groove, 50° is the run-out.
    const arm = playing ? 34 + progress * 16 : 0;
    const armSpring = { type: "spring" as const, stiffness: 55, damping: 14 };

    return (
        <button type="button" onClick={onClick} aria-label={label} className="relative shrink-0" style={{ width: W, height: H }}>
            {/* plinth */}
            <span className="v2-plinth absolute inset-0 rounded-[14px]" />

            {/* platter: strobe dots, mat edge and record all turn together */}
            <span className="absolute left-[10px] top-[10px] h-[92px] w-[92px] rounded-full shadow-[0_3px_7px_-1px_rgba(14,28,51,0.45),0_0_0_0.5px_rgba(14,28,51,0.3)]">
                <span ref={platter} className="v2-platter absolute inset-0 rounded-full">
                    <svg viewBox="0 0 92 92" className="absolute inset-0 h-full w-full">
                        {DOTS.map((a, i) => (
                            <circle key={i} cx={46 + Math.cos(a) * 44.6} cy={46 + Math.sin(a) * 44.6} r="0.55" fill="rgba(14,28,51,0.45)" />
                        ))}
                    </svg>
                    <span className="v2-vinyl absolute inset-[4px] rounded-full">
                        <span className="absolute inset-[33%] overflow-hidden rounded-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cover} alt="" className="h-full w-full scale-[1.4] object-cover" />
                            <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.18),inset_0_0_6px_rgba(0,0,0,0.5)]" />
                        </span>
                    </span>
                </span>
                {/* light on the grooves stays put while the record turns under it */}
                <span className="v2-vinyl-sheen pointer-events-none absolute inset-[4px] rounded-full" />
                <span className="absolute left-1/2 top-1/2 h-[4.5px] w-[4.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white to-[#8e97a6] shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
            </span>

            <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                <defs>
                    <linearGradient id="tt-metal" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#8e97a7" />
                        <stop offset="0.45" stopColor="#f8fafc" />
                        <stop offset="1" stopColor="#a4adbb" />
                    </linearGradient>
                    <linearGradient id="tt-weight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#3a4254" />
                        <stop offset="0.4" stopColor="#6b7486" />
                        <stop offset="1" stopColor="#262d3b" />
                    </linearGradient>
                    <radialGradient id="tt-base" cx="0.35" cy="0.3" r="0.85">
                        <stop offset="0" stopColor="#ffffff" />
                        <stop offset="0.55" stopColor="#d3d9e2" />
                        <stop offset="1" stopColor="#97a0b0" />
                    </radialGradient>
                </defs>

                {/* start/stop and speed buttons */}
                <rect x="12" y="104" width="17" height="6" rx="1.5" fill="#e3e8f0" stroke="rgba(14,28,51,0.18)" strokeWidth="0.5" />
                <rect x="33" y="104" width="9" height="6" rx="1.5" fill={playing ? "#d8e2f6" : "#e3e8f0"} stroke="rgba(14,28,51,0.18)" strokeWidth="0.5" />
                <rect x="45" y="104" width="9" height="6" rx="1.5" fill="#e3e8f0" stroke="rgba(14,28,51,0.18)" strokeWidth="0.5" />
                <text x="37.5" y="108.6" textAnchor="middle" fontSize="3.6" fontFamily="ui-monospace, monospace" fill="rgba(14,28,51,0.55)">33</text>
                <text x="49.5" y="108.6" textAnchor="middle" fontSize="3.6" fontFamily="ui-monospace, monospace" fill="rgba(14,28,51,0.35)">45</text>

                {/* pitch slider */}
                <rect x="147" y="66" width="2.2" height="34" rx="1.1" fill="rgba(14,28,51,0.16)" />
                <line x1="144" y1="83" x2="146" y2="83" stroke="rgba(14,28,51,0.3)" strokeWidth="0.6" />
                <rect x="144.6" y="80.5" width="7" height="5" rx="1.2" fill="url(#tt-metal)" stroke="rgba(14,28,51,0.25)" strokeWidth="0.4" />

                {/* anti-skate dial */}
                <circle cx="147" cy="40" r="4" fill="url(#tt-base)" stroke="rgba(14,28,51,0.2)" strokeWidth="0.5" />
                <line x1="147" y1="40" x2="148.8" y2="37.4" stroke="#2a3244" strokeWidth="0.7" strokeLinecap="round" />

                {/* cue lever: down while playing */}
                <motion.rect
                    x="143"
                    y="51"
                    width="9"
                    height="2.6"
                    rx="1.2"
                    fill="url(#tt-metal)"
                    style={{ originX: "144px", originY: "52.3px" }}
                    animate={{ rotate: playing ? 18 : -12 }}
                    transition={{ duration: 0.3 }}
                />
                <circle cx="144" cy="52.3" r="1.6" fill="#2a3244" />

                {/* arm rest */}
                <rect x="127.5" y="71" width="7" height="3.5" rx="1.4" fill="#cfd5df" stroke="rgba(14,28,51,0.25)" strokeWidth="0.5" />

                {/* arm shadow: grows while the arm is up and travelling */}
                <motion.g style={{ originX: `${PIVOT.x}px`, originY: `${PIVOT.y}px` }} initial={false} animate={{ rotate: arm }} transition={armSpring}>
                    <motion.g
                        key={lifts}
                        opacity="0.2"
                        initial={{ x: 2, y: 3 }}
                        animate={lifts ? { x: [2, 6, 6, 2], y: [3, 8, 8, 3] } : { x: 2, y: 3 }}
                        transition={{ duration: 1.1, times: [0, 0.25, 0.6, 1] }}
                    >
                        <path d="M132 22 C 133 44, 137 62, 130 80 L 127 86" fill="none" stroke="#0e1c33" strokeWidth="3.2" strokeLinecap="round" />
                        <rect x="120" y="83" width="11" height="7" rx="1.5" transform="rotate(-30 125.5 86.5)" fill="#0e1c33" />
                    </motion.g>
                </motion.g>

                {/* tonearm */}
                <motion.g style={{ originX: `${PIVOT.x}px`, originY: `${PIVOT.y}px` }} initial={false} animate={{ rotate: arm }} transition={armSpring}>
                    {/* counterweight */}
                    <rect x="127" y="2.5" width="10" height="11" rx="2" fill="url(#tt-weight)" />
                    {[5.5, 8, 10.5].map((y) => (
                        <line key={y} x1="127.6" y1={y} x2="136.4" y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                    ))}
                    {/* S-shaped tube */}
                    <path d="M132 12 L132 22 C 133 44, 137 62, 130 80 L 127 86" fill="none" stroke="#7d8697" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M132 12 L132 22 C 133 44, 137 62, 130 80 L 127 86" fill="none" stroke="url(#tt-metal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* headshell, cartridge, finger lift */}
                    <g transform="rotate(-30 125.5 86.5)">
                        <rect x="120" y="83" width="11" height="7" rx="1.5" fill="#262d3b" />
                        <rect x="121.2" y="86.2" width="6.5" height="4.2" rx="0.8" fill="#e8743b" />
                        <line x1="131" y1="85" x2="135" y2="84" stroke="url(#tt-metal)" strokeWidth="1.3" strokeLinecap="round" />
                    </g>
                </motion.g>

                {/* pivot */}
                <circle cx={PIVOT.x} cy={PIVOT.y} r="9" fill="url(#tt-base)" stroke="rgba(14,28,51,0.2)" strokeWidth="0.6" />
                <circle cx={PIVOT.x} cy={PIVOT.y} r="5.5" fill="none" stroke="rgba(14,28,51,0.15)" strokeWidth="0.5" />
                <circle cx={PIVOT.x} cy={PIVOT.y} r="3.6" fill="#2a3244" />
                <circle cx={PIVOT.x - 0.9} cy={PIVOT.y - 0.9} r="1.1" fill="#e7ebf2" />
            </svg>

            {/* power light */}
            <span
                className="absolute bottom-[7px] left-[60px] h-[4px] w-[4px] rounded-full transition-all duration-500"
                style={{
                    background: playing ? "#ff5a36" : "rgba(14,28,51,0.2)",
                    boxShadow: playing ? "0 0 6px 1px rgba(255,90,54,0.8)" : "inset 0 1px 1px rgba(0,0,0,0.25)",
                }}
            />
        </button>
    );
}
