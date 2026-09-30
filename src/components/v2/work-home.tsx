'use client';

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useSpring } from "framer-motion";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { SocialLinks } from "@/components/v2/brand-icons";
import { BookCall } from "@/components/v2/book-call";
import { CopyEmail, Reveal, SectionTitle, StaggerText } from "@/components/v2/motion";
import { ProjectCard, type CardProject } from "@/components/v2/project-card";
import type { Role } from "@/data/v2/work";
import { track } from "@/lib/analytics";

export interface WorkHomeProps {
    intro: { headline: string; body: string; now: { lead: string; rest: string } };
    roles: Role[];
    projects: CardProject[];
    projectCount: number;
    testimonials: { name: string; role: string; avatar: string; excerpt: string; quote: string }[];
    posts: { id: string; title: string; date: string }[];
    email: string;
    bookingUrl: string;
    socials: { label: string; href: string }[];
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Everything on this page reads top to bottom without clicking anything.
// Interactions only add detail on top.
export function WorkHome(props: WorkHomeProps) {
    return (
        <div className="mx-auto max-w-2xl">
            <Hero {...props} />
            <div className="space-y-24">
                <Experience roles={props.roles} />
                <Projects projects={props.projects} count={props.projectCount} />
                <KindWords items={props.testimonials} />
                <Blogs posts={props.posts} />
                <Contact email={props.email} bookingUrl={props.bookingUrl} />
            </div>
        </div>
    );
}

function Hero({ intro, roles, email, bookingUrl, socials }: WorkHomeProps) {
    const current = roles.find((r) => r.current);

    return (
        <section className="pb-20 pt-14 sm:pt-24">
            <h1 className="v2-display text-[2.25rem] sm:text-[3rem]">
                <StaggerText parts={[intro.headline]} />
            </h1>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.8 }}
                className="mt-6 space-y-4 text-[17px] leading-relaxed text-[var(--muted)]"
            >
                <p>{intro.body}</p>
                {current && (
                    <p>
                        {intro.now.lead}
                        <a href={current.href} target="_blank" rel="noopener noreferrer" className="v2-link text-[var(--ink)]">
                            {current.company}
                        </a>
                        {intro.now.rest}
                    </p>
                )}
            </motion.div>

            {/* One quiet toolbar: same height, colour and hover for every item. */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="-ml-3 mt-7 flex flex-wrap items-center gap-x-1 gap-y-2 text-[15px]"
            >
                <CopyEmail email={email} />
                <BookCall url={bookingUrl} />
                <span aria-hidden className="mx-1.5 h-4 w-px bg-[var(--faint)]" />
                <SocialLinks links={socials} />
            </motion.div>
        </section>
    );
}

// A rail that draws itself as you scroll. Each company's dot fills in when the
// rail reaches it, and promotions play out bottom-up: the earlier role lands
// first, then the "Promoted" step, then the role it led to.
function Experience({ roles }: { roles: Role[] }) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
    const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

    return (
        <section aria-labelledby="exp">
            <SectionTitle id="exp">Experience</SectionTitle>
            <div ref={ref} className="relative">
                <span aria-hidden className="absolute bottom-3 left-[5px] top-2 w-px bg-[var(--faint)]" />
                <motion.span aria-hidden style={{ scaleY }} className="absolute bottom-3 left-[5px] top-2 w-px origin-top bg-[var(--ink)]" />
                <ol>
                    {roles.map((r) => (
                        <Company key={r.company} role={r} />
                    ))}
                </ol>
            </div>
        </section>
    );
}

function Company({ role }: { role: Role }) {
    const ref = useRef<HTMLLIElement>(null);
    const reached = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
    const n = role.positions.length;

    return (
        <li ref={ref} className="group relative pb-12 pl-8 last:pb-2">
            <motion.span
                aria-hidden
                className={`absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2 transition-colors duration-500 ${
                    reached ? "border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--faint)] bg-[var(--bg)]"
                }`}
                animate={reached ? { scale: [1, 1.5, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
            />
            {role.current && reached && (
                <span aria-hidden className="absolute left-0 top-[7px] h-[11px] w-[11px] animate-ping rounded-full bg-[var(--ink)] opacity-20" />
            )}

            <div className="flex items-baseline justify-between gap-4">
                <a href={role.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-lg font-medium tracking-tight">
                    {role.company}
                    <ArrowUpRight className="h-4 w-4 -translate-x-1 text-[var(--muted)] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </a>
                <span className="v2-mono shrink-0 text-xs text-[var(--muted)]">{role.period}</span>
            </div>
            <p className="text-sm text-[var(--muted)]">{role.about}</p>

            {n === 1 ? (
                <motion.div
                    className="mt-4"
                    initial={{ opacity: 0, y: 14 }}
                    animate={reached ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                >
                    <h3 className="font-medium">{role.positions[0].title}</h3>
                    <p className="mt-1 leading-relaxed text-[color-mix(in_srgb,var(--ink)_82%,transparent)]">{role.positions[0].summary}</p>
                </motion.div>
            ) : (
                <Ladder positions={role.positions} reached={reached} />
            )}
        </li>
    );
}

// Promotions as a quiet ladder: the earlier role sits on a hollow node with a
// muted title, the role it led to on a solid one, joined by a thin line with a
// small chevron. The line draws upward, earlier role first.
function Ladder({ positions, reached }: { positions: Role["positions"]; reached: boolean }) {
    const n = positions.length;
    const STEP = 0.55;

    return (
        <ol className="mt-4 space-y-6">
            {positions.map((p, i) => {
                const step = n - 1 - i; // oldest animates first
                const newest = i === 0;
                return (
                    <li key={p.title} className="relative pl-6">
                        {i < n - 1 && (
                            <>
                                <motion.span
                                    aria-hidden
                                    className="absolute -bottom-[35px] left-[3px] top-[11px] w-px origin-bottom bg-[color-mix(in_srgb,var(--ink)_25%,transparent)]"
                                    initial={{ scaleY: 0 }}
                                    animate={reached ? { scaleY: 1 } : undefined}
                                    transition={{ duration: 0.6, delay: 0.2 + (step - 1) * STEP + 0.3, ease: EASE }}
                                />
                                <motion.span
                                    aria-hidden
                                    className="absolute -bottom-[20px] -left-[1px] bg-[var(--bg)] py-0.5 text-[var(--muted)]"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={reached ? { opacity: 1, y: 0 } : undefined}
                                    transition={{ duration: 0.4, delay: 0.2 + (step - 1) * STEP + 0.55, ease: EASE }}
                                >
                                    <ChevronUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                                </motion.span>
                            </>
                        )}
                        <motion.span
                            aria-hidden
                            className={`absolute left-0 top-[7px] h-[7px] w-[7px] rounded-full border ${
                                newest ? "border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--muted)] bg-[var(--bg)]"
                            }`}
                            initial={{ scale: 0 }}
                            animate={reached ? { scale: 1 } : undefined}
                            transition={{ type: "spring", bounce: 0.5, duration: 0.4, delay: 0.1 + step * STEP }}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={reached ? { opacity: 1, y: 0 } : undefined}
                            transition={{ duration: 0.6, delay: 0.1 + step * STEP, ease: EASE }}
                        >
                            <h3 className={`font-medium ${newest ? "" : "text-[var(--muted)]"}`}>
                                {p.title}
                                {!newest && <span className="sr-only"> (later promoted to {positions[i - 1].title})</span>}
                            </h3>
                            <p className="mt-1 leading-relaxed text-[color-mix(in_srgb,var(--ink)_82%,transparent)]">{p.summary}</p>
                        </motion.div>
                    </li>
                );
            })}
        </ol>
    );
}

function Projects({ projects, count }: { projects: CardProject[]; count: number }) {
    return (
        <section aria-labelledby="proj">
            <SectionTitle
                id="proj"
                aside={
                    <Link href="/projects" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                        See all {count}
                    </Link>
                }
            >
                Selected projects
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((p, i) => (
                    <Reveal key={p.title} delay={(i % 2) * 0.06} className="h-full min-w-0">
                        <ProjectCard project={p} id={`home-${i}`} />
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

// The best line of each review is readable at a glance. Below it, the start of
// the full review fades out over a clear "Read full review" control.
function KindWords({ items }: { items: WorkHomeProps["testimonials"] }) {
    return (
        <section aria-labelledby="words">
            <SectionTitle id="words">What people say</SectionTitle>
            <div className="space-y-14">
                {items.map((t) => (
                    <Reveal key={t.name}>
                        <Testimonial t={t} />
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

function Testimonial({ t }: { t: WorkHomeProps["testimonials"][number] }) {
    const [open, setOpen] = useState(false);
    const id = `review-${t.name.replace(/\W+/g, "-").toLowerCase()}`;

    return (
        <figure>
            <blockquote className="text-[1.3rem] font-medium leading-snug tracking-tight sm:text-[1.45rem]">
                <span className="text-[var(--accent)]">“</span>
                {t.excerpt}
                <span className="text-[var(--accent)]">”</span>
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                <span>
                    <span className="block font-medium">{t.name}</span>
                    <span className="block text-[var(--muted)]">{t.role}</span>
                </span>
            </figcaption>

            <div className="mt-4 border-l-2 border-[var(--faint)] pl-4">
                <motion.div
                    id={id}
                    initial={false}
                    animate={{ height: open ? "auto" : 68 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="relative overflow-hidden"
                >
                    <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--muted)]">{t.quote}</p>
                    <motion.div
                        aria-hidden
                        initial={false}
                        animate={{ opacity: open ? 0 : 1 }}
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--bg)] to-transparent"
                    />
                </motion.div>
                <button
                    onClick={() => {
                        if (!open) track("review_expand", { label: t.name });
                        setOpen(!open);
                    }}
                    aria-expanded={open}
                    aria-controls={id}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]"
                >
                    {open ? "Show less" : "Read full review"}
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                </button>
            </div>
        </figure>
    );
}

function Blogs({ posts }: { posts: WorkHomeProps["posts"] }) {
    return (
        <Reveal>
            <section aria-labelledby="blogs">
                <SectionTitle
                    id="blogs"
                    aside={
                        <Link href="/blogs" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                            All blogs
                        </Link>
                    }
                >
                    Blogs
                </SectionTitle>
                <ul className="v2-focus-list">
                    {posts.map((p) => (
                        <li key={p.id}>
                            <Link href={`/blogs/${p.id}`} className="group flex items-baseline gap-4 py-2.5">
                                <span className="flex-1">{p.title}</span>
                                <span className="v2-mono shrink-0 text-xs text-[var(--muted)]">
                                    {new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </Reveal>
    );
}

function Contact({ email, bookingUrl }: { email: string; bookingUrl: string }) {
    return (
        <Reveal>
            <section aria-labelledby="contact" className="pb-8">
                <SectionTitle id="contact">Say hello</SectionTitle>
                <p className="v2-display max-w-lg text-3xl sm:text-4xl">Always happy to talk engineering, products, or a good problem.</p>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <BookCall url={bookingUrl} variant="solid" label="Book a 15-min call" />
                    <CopyEmail email={email} className="text-[15px]" />
                </div>
            </section>
        </Reveal>
    );
}
