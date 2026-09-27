'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Search } from "lucide-react";
import { LensToggle, useLens, useSwitchLens } from "@/components/v2/lens";
import { CommandPalette } from "@/components/v2/command-palette";
import { isActive, lensNav, pageLens, type SearchItem } from "@/components/v2/nav";
import { profile, type Lens } from "@/data/v2/profile";
import { SocialLinks } from "@/components/v2/brand-icons";
import { PageTransitions } from "@/components/v2/page-transitions";
import { NIGHT, NIGHT_VARS } from "@/components/v2/sky";

export function Shell({
    children,
    searchIndex,
    fontClassName,
}: {
    children: React.ReactNode;
    searchIndex: SearchItem[];
    fontClassName: string;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { lens, setLens, ready } = useLens();
    const switchLens = useSwitchLens();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const theme = pathname.startsWith("/photos") ? "dark" : pathname.startsWith("/sky") ? "space" : "light";

    // Landing on a page that belongs to one side puts the site on that side.
    // Waits for `ready` so the saved lens can't overwrite it on first load.
    useEffect(() => {
        if (!ready) return;
        const owner = pageLens(pathname);
        if (owner && owner !== lens) setLens(owner);
        // only when the route changes (or the saved lens has just been restored)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, ready]);

    // Flipping sides from a page that belongs to the other side goes home.
    const onSwitch = useCallback(
        (next: Lens, origin: HTMLElement | null, after?: () => void) => {
            const owner = pageLens(pathname);
            switchLens(next, origin, () => {
                if (owner && owner !== next) router.push("/");
                after?.();
            });
        },
        [pathname, router, switchLens],
    );

    return (
        <MotionConfig reducedMotion="user">
            <div className={`v2 ${fontClassName}`} data-lens={lens} data-theme={theme} data-ready={ready ? "" : undefined}>
                <Header onSearch={() => setPaletteOpen(true)} onSwitch={onSwitch} />
                <main className="px-5 pb-36 sm:px-8 md:pb-24">{children}</main>
                <Footer onSwitch={onSwitch} night={pathname === "/" && lens === "life"} />
                <MobileDock onSearch={() => setPaletteOpen(true)} />
                <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={searchIndex} />
                <PageTransitions />
            </div>
        </MotionConfig>
    );
}

// One row, one column width: identity on the left, this side's pages on the right.
function Header({ onSearch, onSwitch }: { onSearch: () => void; onSwitch: (next: Lens, origin: HTMLElement | null) => void }) {
    const pathname = usePathname();
    const { lens } = useLens();
    const [hovered, setHovered] = useState<string | null>(null);
    const { scrollY } = useScroll();
    const [scrolled, setScrolled] = useState(false);
    useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

    const items = lensNav[lens].slice(1);

    return (
        <header
            className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
                scrolled ? "border-[var(--faint)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-xl" : "border-transparent"
            }`}
        >
            <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
                <div className="flex flex-1 items-center gap-3 px-5 sm:px-8 md:px-0">
                    <Link href="/" className="group flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
                        <Image
                            src="/img/img.png"
                            alt=""
                            width={28}
                            height={28}
                            className="rounded-full ring-1 ring-black/5 transition-transform duration-500 ease-out group-hover:-rotate-12 group-hover:scale-110"
                        />
                        {profile.name}
                    </Link>
                    <div className="ml-auto md:hidden">
                        <LensToggle onSwitch={onSwitch} />
                    </div>
                </div>

                <nav className="hidden items-center md:flex" aria-label="Main" onMouseLeave={() => setHovered(null)}>
                    <AnimatePresence mode="popLayout" initial={false}>
                        {items.map((item) => {
                            const active = isActive(pathname, item.href);
                            return (
                                <motion.div
                                    key={item.href}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 6 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <Link
                                        href={item.href}
                                        onMouseEnter={() => setHovered(item.href)}
                                        className={`relative block px-3 py-1.5 text-sm transition-colors ${
                                            active ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                                        }`}
                                    >
                                        {hovered === item.href && (
                                            <motion.span
                                                layoutId="nav-hover"
                                                className="absolute inset-0 rounded-full bg-[var(--faint)]"
                                                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                                            />
                                        )}
                                        <span className="relative">{item.label}</span>
                                        {active && (
                                            <motion.span
                                                layoutId="nav-active"
                                                className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--accent)]"
                                            />
                                        )}
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    <div className="mx-3">
                        <LensToggle onSwitch={onSwitch} />
                    </div>
                    <button
                        onClick={onSearch}
                        aria-label="Search (⌘K)"
                        title="Search  ⌘K"
                        className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--faint)] hover:text-[var(--ink)]"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </nav>
            </div>
        </header>
    );
}

// Floating thumb-reach dock for phones, showing this side's pages.
// Hides while scrolling down, returns on scroll up.
function MobileDock({ onSearch }: { onSearch: () => void }) {
    const pathname = usePathname();
    const { lens } = useLens();
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const last = useRef(0);

    useMotionValueEvent(scrollY, "change", (y) => {
        const diff = y - last.current;
        if (Math.abs(diff) > 6) setHidden(diff > 0 && y > 200);
        last.current = y;
    });

    return (
        <motion.nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-4 z-40 flex justify-center md:hidden"
            animate={{ y: hidden ? 110 : 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        >
            <motion.div
                layout
                transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                className="flex items-center gap-0.5 rounded-full border border-[var(--faint)] bg-[color-mix(in_srgb,var(--card)_85%,transparent)] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {lensNav[lens].filter((item) => item.dock !== false).map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                            <motion.div
                                key={item.href}
                                layout
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                            >
                                <Link
                                    href={item.href}
                                    aria-label={item.label}
                                    className={`relative flex h-11 items-center gap-2 rounded-full px-3.5 transition-colors ${
                                        active ? "text-[var(--bg)]" : "text-[var(--muted)] active:scale-95"
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="dock-active"
                                            className="absolute inset-0 rounded-full bg-[var(--ink)]"
                                            transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                                        />
                                    )}
                                    <Icon className="relative h-[18px] w-[18px]" strokeWidth={1.75} />
                                    {active && item.href !== "/" && <span className="relative text-sm font-medium">{item.label}</span>}
                                </Link>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <span className="mx-1 h-5 w-px bg-[var(--faint)]" />
                <button onClick={onSearch} aria-label="Search" className="flex h-11 items-center rounded-full px-3 text-[var(--muted)] active:scale-95">
                    <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
            </motion.div>
        </motion.nav>
    );
}

// On the life home the page ends in night, so the footer stays in it too.
function Footer({ onSwitch, night }: { onSwitch: (next: Lens, origin: HTMLElement | null, after?: () => void) => void; night: boolean }) {
    const { lens } = useLens();
    const other: Lens = lens === "work" ? "life" : "work";
    const ref = useRef<HTMLButtonElement>(null);

    return (
        <div style={night ? { ...NIGHT_VARS, background: NIGHT, color: "var(--ink)" } : undefined}>
            <footer className="mx-auto max-w-2xl px-5 pb-32 sm:px-8 md:px-0 md:pb-12">
                <div className="border-t border-[var(--faint)] pt-8">
                    <button
                        ref={ref}
                        onClick={() => onSwitch(other, ref.current, () => window.scrollTo(0, 0))}
                        className="group text-left"
                    >
                        <span className="v2-eyebrow block">{lens === "work" ? "Off the clock" : "Here for work?"}</span>
                        <span className="mt-1 inline-flex items-center gap-2 text-2xl font-medium tracking-tight">
                            {lens === "work" ? "See the life side" : "See the work side"}
                            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                        </span>
                    </button>
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                        <span>© {new Date().getFullYear()} {profile.name}</span>
                        <SocialLinks links={profile.socials} className="-mr-2" />
                    </div>
                </div>
            </footer>
        </div>
    );
}
