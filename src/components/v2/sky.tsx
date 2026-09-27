'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Starfield } from "@/components/v2/starfield";
import { MoonDisc, useMoon } from "@/components/v2/moon";
import { Reveal, SectionTitle, StaggerText } from "@/components/v2/motion";
import { Pulsar } from "@/components/v2/pulsar";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function SkyPage() {
    return (
        <>
            <Starfield className="pointer-events-none fixed inset-0 h-full w-full" />
            <div className="relative z-10 mx-auto max-w-2xl">
                <Hero />
                <div className="space-y-28">
                    <LiveCounters />
                    <PulsarSection />
                    <Facts />
                    <p className="pb-6 text-sm text-[var(--muted)]">
                        Numbers are rounded, and the moon is worked out from the average lunar cycle, so it can be off by a few hours.
                    </p>
                </div>
            </div>
        </>
    );
}

function Hero() {
    const phase = useMoon();
    return (
        <section className="flex flex-col-reverse gap-10 pb-24 pt-16 sm:flex-row sm:items-center sm:justify-between sm:pt-28">
            <div className="max-w-md">
                <p className="v2-eyebrow">Astronomy</p>
                <h1 className="v2-display mt-4 text-[3.5rem] sm:text-[4.75rem]">
                    <StaggerText parts={["Look up."]} />
                </h1>
                <motion.p
                    className="mt-6 text-[17px] leading-relaxed text-[var(--muted)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1 }}
                >
                    I&apos;ve always wondered about the night sky. As a kid I could never work out why the moon kept following me whenever I
                    walked, and I still look up every chance I get. The sky has a way of shrinking our problems back to their real size, and I
                    genuinely think that if everyone looked at it once a night, we&apos;d live differently.
                </motion.p>
            </div>
            <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:text-right">
                <MoonDisc phase={phase} size={150} />
                <motion.div initial={{ opacity: 0 }} animate={phase ? { opacity: 1 } : undefined} transition={{ delay: 0.8, duration: 0.8 }}>
                    <p className="text-sm text-[var(--muted)]">Tonight&apos;s moon</p>
                    <p className="font-medium">{phase?.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                        {phase && `${Math.round(phase.illumination * 100)}% lit`}
                        {phase && phase.fraction < 0.5 && ` · full in ${Math.round(phase.daysToFull)} days`}
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

// Numbers that keep changing while you read.
const EARTH_ORBIT_KMS = 29.78;
const VOYAGER_KMS = 16.99;
const VOYAGER_BASE = { at: Date.UTC(2025, 0, 1), km: 24.65e9 }; // ~164.8 AU on 1 Jan 2025
const LIGHT_KMS = 299_792.458;

function LiveCounters() {
    const [elapsed, setElapsed] = useState(0);
    const [now, setNow] = useState<number | null>(null);
    const start = useRef(0);

    useEffect(() => {
        start.current = performance.now();
        let raf = 0;
        const tick = () => {
            setElapsed((performance.now() - start.current) / 1000);
            setNow(Date.now());
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const voyagerKm = now ? VOYAGER_BASE.km + ((now - VOYAGER_BASE.at) / 1000) * VOYAGER_KMS : null;
    const lightHours = voyagerKm ? voyagerKm / LIGHT_KMS / 3600 : null;
    const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

    return (
        <section aria-labelledby="live">
            <SectionTitle id="live">While you&apos;re reading this</SectionTitle>
            <div className="space-y-10">
                <Reveal>
                    <p className="text-[1.35rem] leading-snug tracking-tight sm:text-[1.6rem]">
                        Earth has carried you{" "}
                        <span className="v2-mono whitespace-nowrap tabular-nums text-[var(--accent)]">{fmt(elapsed * EARTH_ORBIT_KMS, 1)} km</span> around the Sun
                        since you opened this page.
                    </p>
                </Reveal>
                <Reveal>
                    <p className="text-[1.35rem] leading-snug tracking-tight sm:text-[1.6rem]">
                        Voyager 1 is about{" "}
                        <span className="v2-mono whitespace-nowrap tabular-nums text-[var(--accent)]">{voyagerKm ? fmt(voyagerKm) : "…"} km</span> from home and
                        still going. A message to it would take{" "}
                        <span className="v2-mono whitespace-nowrap tabular-nums text-[var(--accent)]">{lightHours ? fmt(lightHours, 1) : "…"} hours</span> to arrive.
                    </p>
                </Reveal>
            </div>
        </section>
    );
}

// A pulsar instead of a planet tour: the thing I'd most like to see with my own eyes.
function PulsarSection() {
    return (
        <section aria-labelledby="pulsar">
            <SectionTitle id="pulsar">A lighthouse made of a dead star</SectionTitle>
            <p className="max-w-xl leading-relaxed text-[var(--muted)]">
                When a big star dies, its core can collapse into a neutron star: more mass than the Sun, packed into a ball about 20 km
                across, spinning absurdly fast. Its magnetic poles fire beams of radio waves, and because they&apos;re tilted off the spin
                axis they sweep around like a lighthouse. Every time one crosses Earth, a telescope sees a pulse. The Crab Pulsar does
                this 30 times a second, more regularly than most clocks.
            </p>
            <div className="mt-8">
                <Pulsar />
            </div>
        </section>
    );
}

// Frontier stuff: things we've only learned (or only been able to see) recently.
const FACTS = [
    {
        when: "2015 · LIGO",
        stat: "Spacetime, measured",
        text: "Two black holes merged 1.3 billion light-years away, and the ripple in spacetime stretched LIGO's 4 km arms by less than a hundredth of a proton's width. We noticed.",
    },
    {
        when: "2017 · GW170817",
        stat: "Where gold comes from",
        text: "Two neutron stars collided 130 million light-years away. We caught it in gravitational waves and in light at the same time, and watched the blast forge heavy elements. Some of the gold on Earth was probably made like this.",
    },
    {
        when: "2023 · Pulsar timing arrays",
        stat: "The galaxy as a detector",
        text: "By timing dozens of pulsars to within a millionth of a second for years, astronomers found evidence of a slow background hum in spacetime, most likely from pairs of supermassive black holes all across the universe.",
    },
    {
        when: "2019 · Event Horizon Telescope",
        stat: "A photo of a shadow",
        text: "Linking radio dishes across the planet into one Earth-sized telescope, we photographed the shadow of the black hole in M87. In 2022 we did it again for Sagittarius A*, the one at the centre of our own galaxy.",
    },
    {
        when: "2020 · SGR 1935+2154",
        stat: "Fast radio bursts, traced",
        text: "Fast radio bursts are millisecond flashes from other galaxies. For years nobody knew what made them, until one went off inside the Milky Way and pointed straight at a magnetar.",
    },
    {
        when: "Magnetars",
        stat: "10¹⁵ × Earth's magnetic field",
        text: "Magnetars are neutron stars with magnetic fields about a thousand trillion times stronger than Earth's. From a thousand kilometres away, one would pull apart the atoms in your body.",
    },
    {
        when: "Neutron star crusts",
        stat: "Nuclear pasta",
        text: "Just under a neutron star's surface, nuclei may get squeezed into sheets and tubes physicists call nuclear pasta. Simulations suggest it could be the strongest material in the universe, billions of times stronger than steel.",
    },
    {
        when: "Right now · Hubble tension",
        stat: "73 vs 67",
        text: "Measure how fast the universe is expanding using nearby stars and you get about 73 km/s per megaparsec. Work it out from the Big Bang's afterglow and you get about 67. Better data hasn't made the gap go away, and nobody knows why yet.",
    },
];

function Facts() {
    return (
        <section aria-labelledby="facts">
            <SectionTitle id="facts">Things that still get me</SectionTitle>
            <div className="grid gap-px overflow-hidden rounded-2xl bg-[var(--faint)] sm:grid-cols-2">
                {FACTS.map((f, i) => (
                    <Reveal key={f.stat} delay={(i % 2) * 0.08} className="h-full">
                        <div className="group relative h-full overflow-hidden bg-[var(--card)] p-6 transition-colors duration-500 hover:bg-[#0f1430]">
                            <span
                                aria-hidden
                                className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(157,180,255,0.25),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                            />
                            <p className="v2-mono relative text-[11px] uppercase tracking-wider text-[var(--accent)]">{f.when}</p>
                            <p className="relative mt-2 text-xl font-medium tracking-tight">{f.stat}</p>
                            <p className="relative mt-2 leading-relaxed text-[var(--muted)]">{f.text}</p>
                        </div>
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

// Colours the night sections share, so text, the easter egg and the footer can
// all sit on the dark end of the life page.
export const NIGHT = "#070b1f";
export const NIGHT_VARS = {
    "--bg": NIGHT,
    "--ink": "#e8ecff",
    "--muted": "#8a93b8",
    "--faint": "#1c2140",
    "--card": "#0a0d1f",
    "--accent": "#9db4ff",
    "--accent-soft": "#1a2150",
} as React.CSSProperties;

// The finale of the life home. By the time you get here the page has faded
// into night (see LifeSky in life-home), stars come out, the moon rises with
// your scroll, and "Come look up" spreads the night out from the button.
export function SkyTeaser({ href }: { href: string }) {
    const phase = useMoon();
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
    const moonY = useTransform(scrollYProgress, [0, 1], [160, 0]);
    const stars = useTransform(scrollYProgress, [0.05, 0.55], [0, 1]);
    const text = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);

    return (
        <div ref={ref} data-sky-band className="relative left-1/2 w-screen -translate-x-1/2" style={NIGHT_VARS}>
            <motion.div
                aria-hidden
                style={{ opacity: stars }}
                className="pointer-events-none absolute inset-x-0 -bottom-48 top-0 [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
            >
                <Starfield className="h-full w-full" density={1.1} />
            </motion.div>
            <div className="relative mx-auto flex min-h-[620px] max-w-2xl items-center justify-between gap-6 px-5 sm:px-8 md:px-0">
                <motion.div style={{ opacity: text }} className="max-w-sm">
                    <p className="text-[13px] font-medium text-[var(--muted)]">Looking up</p>
                    <p className="v2-display mt-3 text-[2rem] text-[var(--ink)] sm:text-[2.4rem]">I&apos;ve always wondered about the night sky.</p>
                    <p className="mt-3 text-[#aab4d6]">
                        {phase ? `Tonight's moon is a ${phase.name.toLowerCase()}, ${Math.round(phase.illumination * 100)}% lit.` : "\u00a0"}
                    </p>
                    <Link
                        href={href}
                        data-vt-origin
                        className="group mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--ink)] transition-colors duration-300 hover:border-white/30 hover:bg-white/10"
                    >
                        Come look up
                        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </Link>
                </motion.div>
                <motion.div style={{ y: moonY }} className="shrink-0">
                    <MoonDisc phase={phase} size={120} />
                </motion.div>
            </div>
        </div>
    );
}
