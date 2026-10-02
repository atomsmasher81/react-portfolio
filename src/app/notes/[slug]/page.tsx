import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReadingProgress } from "@/components/v2/reading-progress";
import { notes } from "@/data/v2/notes";
import { JsonLd } from "@/components/JsonLd";
import { article, breadcrumbs, pageMeta } from "@/lib/seo";

export function generateStaticParams() {
    return notes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const note = notes.find((n) => n.slug === params.slug);
    if (!note) return { title: "Note" };
    return pageMeta({ title: note.title, description: note.excerpt, path: `/notes/${note.slug}`, type: "article", publishedTime: note.date });
}

export default async function NotePage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const index = notes.findIndex((n) => n.slug === params.slug);
    if (index < 0) notFound();
    const note = notes[index];
    const others = notes.filter((n) => n.slug !== note.slug).slice(0, 2);

    const path = `/notes/${note.slug}`;

    return (
        <article className="mx-auto max-w-2xl">
            <JsonLd
                nodes={[
                    article({
                        type: "Article",
                        path,
                        headline: note.title,
                        description: note.excerpt,
                        datePublished: note.date,
                        wordCount: note.body.split(/\s+/).length,
                    }),
                    breadcrumbs([
                        { name: "Notes", path: "/notes" },
                        { name: note.title, path },
                    ]),
                ]}
            />
            <ReadingProgress />
            <Link href="/notes" className="mt-6 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                ← Notes
            </Link>
            <header className="pb-8 pt-8">
                <p className="text-sm text-[var(--muted)]">
                    By{" "}
                    <Link href="/?lens=life" rel="author" className="v2-link text-[var(--ink)]">
                        Kartik Gautam
                    </Link>{" "}
                    ·{" "}
                    <time dateTime={note.date}>
                        {new Date(note.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </time>
                </p>
                <h1 className="v2-display mt-3 text-4xl sm:text-5xl">{note.title}</h1>
            </header>
            <div className="v2-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
            </div>
            <footer className="mt-16 border-t border-[var(--faint)] pt-6">
                <p className="mb-3 text-sm text-[var(--muted)]">Keep wandering</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {others.map((n) => (
                        <Link key={n.slug} href={`/notes/${n.slug}`} className="group rounded-xl border border-[var(--faint)] p-4 hover:bg-[var(--card)]">
                            <span className="text-lg font-medium tracking-tight group-hover:text-[var(--accent)]">{n.title}</span>
                            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{n.excerpt}</p>
                        </Link>
                    ))}
                </div>
            </footer>
        </article>
    );
}
