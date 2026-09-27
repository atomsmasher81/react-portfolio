'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { useSwitchLens } from "@/components/v2/lens";
import { profile } from "@/data/v2/profile";
import type { SearchItem } from "@/components/v2/nav";

const GROUP_ORDER: SearchItem["group"][] = ["Pages", "Actions", "Notes", "Blogs", "Projects", "Links"];

function matches(item: SearchItem, query: string) {
    const hay = `${item.label} ${item.hint ?? ""} ${item.group}`.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => hay.includes(token));
}

export function CommandPalette({
    open,
    onOpenChange,
    items,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: SearchItem[];
}) {
    const router = useRouter();
    const switchLens = useSwitchLens();
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // ⌘K / Ctrl+K anywhere, or "/" when not typing.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable]");
            if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onOpenChange]);

    useEffect(() => {
        if (open) {
            setQuery("");
            setActive(0);
        }
    }, [open]);

    const results = useMemo(() => {
        const filtered = query ? items.filter((i) => matches(i, query)) : items.filter((i) => i.group !== "Projects");
        return GROUP_ORDER.flatMap((g) => filtered.filter((i) => i.group === g));
    }, [items, query]);

    useEffect(() => setActive(0), [query]);

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const run = (item: SearchItem) => {
        if (item.action === "lens-work" || item.action === "lens-life") {
            switchLens(item.action === "lens-work" ? "work" : "life");
            if (!["/", "/"].includes(window.location.pathname)) router.push("/");
        } else if (item.action === "copy-email") {
            navigator.clipboard?.writeText(profile.email).catch(() => {});
            setToast("Email copied");
            setTimeout(() => setToast(null), 1600);
        } else if (item.href && item.external) {
            window.open(item.href, "_blank", "noopener,noreferrer");
        } else if (item.href) {
            router.push(item.href);
        }
        onOpenChange(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            run(results[active]);
        } else if (e.key === "Escape") {
            onOpenChange(false);
        }
    };

    let lastGroup: string | null = null;

    return (
        <>
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Search"
                            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--faint)] bg-[var(--card)] text-[var(--ink)] shadow-2xl"
                            initial={{ scale: 0.96, y: -8 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: -4 }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                        >
                            <div className="flex items-center gap-3 border-b border-[var(--faint)] px-4">
                                <Search className="h-4 w-4 text-[var(--muted)]" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    placeholder="Jump to a page, note, project…"
                                    className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
                                    role="combobox"
                                    aria-expanded="true"
                                    aria-controls="v2-palette-list"
                                    aria-activedescendant={results[active] ? `v2-opt-${results[active].id}` : undefined}
                                />
                                <kbd className="v2-mono rounded border border-[var(--faint)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">esc</kbd>
                            </div>
                            <div ref={listRef} id="v2-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                                {results.length === 0 && (
                                    <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">Nothing for “{query}”.</p>
                                )}
                                {results.map((item, i) => {
                                    const header = item.group !== lastGroup ? item.group : null;
                                    lastGroup = item.group;
                                    return (
                                        <div key={item.id}>
                                            {header && (
                                                <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                                                    {header}
                                                </p>
                                            )}
                                            <button
                                                id={`v2-opt-${item.id}`}
                                                role="option"
                                                aria-selected={i === active}
                                                data-index={i}
                                                onMouseMove={() => setActive(i)}
                                                onClick={() => run(item)}
                                                className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px]"
                                            >
                                                {i === active && (
                                                    <motion.span
                                                        layoutId="palette-active"
                                                        className="absolute inset-0 rounded-lg bg-[var(--faint)]"
                                                        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                                                    />
                                                )}
                                                <span className="relative flex-1 truncate">{item.label}</span>
                                                {item.hint && (
                                                    <span className="relative hidden truncate text-sm text-[var(--muted)] sm:block">{item.hint}</span>
                                                )}
                                                <span className="relative text-[var(--muted)]">
                                                    {item.external ? (
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    ) : i === active ? (
                                                        <CornerDownLeft className="h-3.5 w-3.5" />
                                                    ) : null}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)]"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
