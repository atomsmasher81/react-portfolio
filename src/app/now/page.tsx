import { Prose } from "@/components/v2/motion";
import { OnLoop } from "@/components/v2/on-loop";
import { ReadingPhoto } from "@/components/v2/reading-photo";
import { now, type NowEntry } from "@/data/v2/now";

export const metadata = { title: "Now", description: "What Kartik is reading, learning and making these days." };

// Re-render hourly so "x days ago" doesn't freeze at build time.
export const revalidate = 3600;

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function Letter({ entry }: { entry: NowEntry }) {
    return (
        <>
            <div className="gap-10 sm:grid sm:grid-cols-[1fr_180px] sm:items-start">
                <div className="min-w-0 space-y-5">
                    {entry.paragraphs.map((p) => (
                        <Prose key={p} text={p} className="text-[1.2rem] leading-relaxed tracking-tight sm:text-[1.3rem]" />
                    ))}
                </div>
                {entry.reading && (
                    <div className="mt-8 flex justify-center sm:mt-1 sm:block">
                        <ReadingPhoto {...entry.reading} />
                    </div>
                )}
            </div>
            {entry.listening && (
                <div className="mt-14 flex justify-center">
                    <OnLoop song={entry.listening} />
                </div>
            )}
        </>
    );
}

export default function NowPage() {
    const days = Math.max(0, Math.round((Date.now() - new Date(now.updated).getTime()) / 86_400_000));

    return (
        <div className="mx-auto max-w-2xl">
            <header className="pb-12 pt-14 sm:pt-24">
                <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">Now</h1>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                    What I&apos;d tell you if we bumped into each other after a year.
                </p>
                <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    Updated {longDate(now.updated)}
                    <span className="text-[var(--muted)]">
                        · {days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`} · {now.location}
                    </span>
                </p>
            </header>

            <Letter entry={now} />
        </div>
    );
}
