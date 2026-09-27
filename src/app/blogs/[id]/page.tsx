import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReadingProgress } from "@/components/v2/reading-progress";
import { blogs } from "@/data/blogs";

export function generateStaticParams() {
    return blogs.map((b) => ({ id: b.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
    const post = blogs.find((b) => b.id === params.id);
    return post ? { title: post.title, description: post.description } : { title: "Blogs" };
}

export default function PostPage({ params }: { params: { id: string } }) {
    const post = blogs.find((b) => b.id === params.id);
    if (!post) notFound();

    return (
        <article className="mx-auto max-w-2xl">
            <ReadingProgress />
            <Link href="/blogs" className="mt-6 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                ← Blogs
            </Link>
            <header className="pb-10 pt-8">
                <p className="text-sm text-[var(--muted)]">
                    {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {post.readTime}
                </p>
                <h1 className="v2-display mt-3 text-[2.1rem] sm:text-[2.75rem]">{post.title}</h1>
            </header>
            <div className="v2-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
            </div>
        </article>
    );
}
