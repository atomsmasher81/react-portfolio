import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReadingProgress } from "@/components/v2/reading-progress";
import { blogs } from "@/data/blogs";
import { JsonLd } from "@/components/JsonLd";
import { article, breadcrumbs, pageMeta } from "@/lib/seo";

// Posts open with their own "# Title"; the page header already is the h1.
const body = (content: string) => content.replace(/^\s*# .*\n+/, "");

export function generateStaticParams() {
    return blogs.map((b) => ({ id: b.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
    const post = blogs.find((b) => b.id === params.id);
    if (!post) return { title: "Blogs" };
    return pageMeta({ title: post.title, description: post.description, path: `/blogs/${post.id}`, type: "article", publishedTime: post.date, ownImage: true });
}

export default function PostPage({ params }: { params: { id: string } }) {
    const post = blogs.find((b) => b.id === params.id);
    if (!post) notFound();

    const path = `/blogs/${post.id}`;
    const text = body(post.content);

    return (
        <article className="mx-auto max-w-2xl">
            <JsonLd
                nodes={[
                    article({
                        path,
                        headline: post.title,
                        description: post.description,
                        datePublished: post.date,
                        keywords: post.tags,
                        wordCount: text.split(/\s+/).length,
                    }),
                    breadcrumbs([
                        { name: "Blogs", path: "/blogs" },
                        { name: post.title, path },
                    ]),
                ]}
            />
            <ReadingProgress />
            <Link href="/blogs" className="mt-6 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                ← Blogs
            </Link>
            <header className="pb-10 pt-8">
                <p className="text-sm text-[var(--muted)]">
                    By{" "}
                    <Link href="/?lens=work" rel="author" className="v2-link text-[var(--ink)]">
                        Kartik Gautam
                    </Link>{" "}
                    ·{" "}
                    <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </time>{" "}
                    · {post.readTime}
                </p>
                <h1 className="v2-display mt-3 text-[2.1rem] sm:text-[2.75rem]">{post.title}</h1>
            </header>
            <div className="v2-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
        </article>
    );
}
