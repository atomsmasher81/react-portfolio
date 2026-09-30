import Link from "next/link";
import { Reveal } from "@/components/v2/motion";
import { notes } from "@/data/v2/notes";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Notes", description: "Short reflections, written to think rather than to publish.", path: "/notes" });

export default function NotesPage() {
    const byYear = notes.reduce<Record<string, typeof notes>>((acc, n) => {
        (acc[n.date.slice(0, 4)] ??= []).push(n);
        return acc;
    }, {});

    return (
        <div className="mx-auto max-w-2xl">
            <header className="pb-12 pt-14 sm:pt-24">
                <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">Notes</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                    Short reflections, written to think rather than to publish. Some are half-baked on purpose.
                </p>
            </header>

            {Object.entries(byYear)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([year, list]) => (
                    <section key={year} className="mb-10">
                        <h2 className="v2-mono mb-2 text-sm text-[var(--muted)]">{year}</h2>
                        {list.map((n, i) => (
                            <Reveal key={n.slug} delay={i * 0.05}>
                                <Link href={`/notes/${n.slug}`} className="group -mx-3 block rounded-xl px-3 py-4 transition-colors hover:bg-[var(--card)]">
                                    <div className="flex items-baseline gap-3">
                                        <h3 className="flex-1 text-lg font-medium tracking-tight leading-snug group-hover:text-[var(--accent)]">{n.title}</h3>
                                        <span className="v2-mono shrink-0 text-xs text-[var(--muted)]">
                                            {new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[var(--muted)]">{n.excerpt}</p>
                                </Link>
                            </Reveal>
                        ))}
                    </section>
                ))}
        </div>
    );
}
